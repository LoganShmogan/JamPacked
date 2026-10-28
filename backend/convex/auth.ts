import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { MutationCtx, action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { createBusiness, newBusinessFields } from "./lib/business";
import { hashPassword, randomHex, verifyPassword } from "./lib/password";
import { getUser } from "./lib/session";

const SESSION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const publicUser = (u: Doc<"users">) => ({ _id: u._id, email: u.email, name: u.name });

const businessArg = v.optional(v.object(newBusinessFields));

/**
 * Sign-up creates the account and its main business in one go. Someone who was invited by
 * email can sign up without a business; they join the businesses that invited them.
 */
export const register = action({
  args: { email: v.string(), name: v.string(), password: v.string(), business: businessArg },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const email = args.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ConvexError("Enter a valid email address");
    if (args.password.length < 8) throw new ConvexError("Password must be at least 8 characters");
    if (!args.name.trim()) throw new ConvexError("Name is required");
    const { hash, salt } = await hashPassword(args.password);
    return await ctx.runMutation(internal.auth.createUserAndSession, {
      email,
      name: args.name.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      token: randomHex(32),
      business: args.business,
    });
  },
});

/** Turns pending email invites into memberships. Returns how many were claimed. */
async function claimInvites(ctx: MutationCtx, user: Doc<"users">) {
  const invites = await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", user.email)).collect();
  let claimed = 0;
  for (const inv of invites.filter((i) => i.acceptedAt === undefined)) {
    await ctx.db.insert("memberships", {
      userId: user._id,
      businessId: inv.businessId,
      role: inv.role,
      active: true,
      createdAt: Date.now(),
    });
    await ctx.db.patch(inv._id, { acceptedAt: Date.now() });
    await logAudit(ctx, user, {
      businessId: inv.businessId,
      action: "join",
      entityType: "membership",
      entityId: user._id,
      summary: `${user.name} joined as ${inv.role} (invited by ${inv.invitedByName})`,
    });
    claimed++;
  }
  return claimed;
}

export const createUserAndSession = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    token: v.string(),
    business: businessArg,
  },
  handler: async (ctx, { token, business, ...args }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) throw new ConvexError("An account with that email already exists");
    const userId = await ctx.db.insert("users", { ...args, active: true, createdAt: Date.now() });
    const user = (await ctx.db.get(userId))!;
    await logAudit(ctx, user, {
      action: "register",
      entityType: "user",
      entityId: userId,
      summary: `Account created for ${args.email}`,
    });
    const joined = await claimInvites(ctx, user);
    if (business) await createBusiness(ctx, user, business);
    else if (joined === 0) throw new ConvexError("Set up your business to create an account");
    await ctx.db.insert("sessions", { userId, token, expiresAt: Date.now() + SESSION_MS });
    return { token };
  },
});

export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.runQuery(internal.auth.userByEmail, { email });
    const ok =
      !!user && user.active && (await verifyPassword(args.password, user.passwordSalt, user.passwordHash));
    const token = ok ? randomHex(32) : undefined;
    await ctx.runMutation(internal.auth.recordLogin, { email, userId: ok ? user!._id : undefined, token });
    if (!ok || !token) throw new ConvexError("Incorrect email or password");
    return { token };
  },
});

export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: (ctx, { email }) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique(),
});

export const recordLogin = internalMutation({
  args: { email: v.string(), userId: v.optional(v.id("users")), token: v.optional(v.string()) },
  handler: async (ctx, { email, userId, token }) => {
    const user = userId ? await ctx.db.get(userId) : null;
    if (user && token) {
      await ctx.db.insert("sessions", { userId: user._id, token, expiresAt: Date.now() + SESSION_MS });
    }
    await logAudit(ctx, user, {
      action: user ? "login" : "login_failed",
      entityType: "user",
      entityId: user?._id,
      summary: user ? `${user.name} signed in` : `Failed sign-in attempt for ${email}`,
    });
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .unique();
    if (!session) return;
    const user = await ctx.db.get(session.userId);
    await ctx.db.delete(session._id); // sessions are credentials, not records; safe to remove
    await logAudit(ctx, user, {
      action: "logout",
      entityType: "user",
      entityId: session.userId,
      summary: `${user?.name ?? "User"} signed out`,
    });
  },
});

export const me = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await getUser(ctx, sessionToken);
    return user ? publicUser(user) : null;
  },
});
