import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { legalDocs } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  legalDocs.cookies.href,
  legalDocs.cookies.title,
  "JamPacked's website doesn't use advertising or tracking cookies. What the website and app store on your device, and why.",
);

// Must match what the site does: components/Analytics.tsx keeps PostHog in memory only (no cookies or
// local storage). Update this page before adding anything that stores data in the browser.
export default function Cookies() {
  return (
    <LegalPage
      title="Cookies & data policy"
      updated={legalDocs.cookies.updated}
      intro={<p>Short version: this website doesn&apos;t use advertising or tracking cookies, so there&apos;s no cookie banner.</p>}
      sections={[
        {
          heading: "This website",
          body: [
            <p key="a">The website sets no cookies. If we turn on visitor analytics, it counts page views in memory only: nothing is saved on your device, and nothing follows you to other sites.</p>,
            <p key="b">Analytics never include the contents of your business records.</p>,
          ],
        },
        {
          heading: "The JamPacked app",
          body: [
            <p key="a">When you sign in, the app keeps a sign-in token on your device so you stay signed in, and remembers which business you last worked in. It doesn&apos;t keep copies of your business records, products, recipes or customers on the device. Signing out removes the token.</p>,
          ],
        },
        {
          heading: "Payments",
          body: [
            <p key="a">When you buy a paid licence you&apos;re taken to Stripe&apos;s checkout, which uses its own cookies to process the payment securely and prevent fraud. See Stripe&apos;s privacy policy at stripe.com/privacy.</p>,
          ],
        },
        {
          heading: "More information",
          body: [
            <p key="a">How we handle personal information is set out in our <Link href="/legal/privacy/" className="underline">Privacy Policy</Link>.</p>,
          ],
        },
      ]}
    />
  );
}
