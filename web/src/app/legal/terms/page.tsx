import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { legalDocs } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";
import { pricing, site } from "@/lib/site";

export const metadata = pageMetadata(legalDocs.terms.href, legalDocs.terms.title, "The terms for buying and using a JamPacked licence.");

// Draft based on Save Point's own terms (13 May 2026). Have a NZ lawyer review before launch
// (docs/issues/legal-documents.md), and change the date whenever the wording changes.
export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={legalDocs.terms.updated}
      intro={
        <p>
          These terms apply when you buy a JamPacked licence or use the JamPacked app or website. JamPacked is provided by{" "}
          {site.company} (&quot;we&quot;, &quot;us&quot;). By buying a licence or using JamPacked, you agree to them on behalf of your business.
        </p>
      }
      sections={[
        {
          heading: "The service",
          body: [
            <p key="a">
              JamPacked is software for recording goods inwards, stock, production (recipes and the batches you make), temperatures,
              programme records and audits. It remembers the products, supplies, suppliers and customers you enter so they can be
              picked or scanned next time. It runs on Android, iPhone and the web.
            </p>,
            <p key="b">
              JamPacked helps you keep records. It doesn&apos;t replace your registered food control plan or National Programme, and your
              verifier, EHO or regulator decides what&apos;s required. Programme modules are based on MPI guidance as a starting point; they
              are not endorsed by MPI or FSANZ, and you&apos;re responsible for checking them against your registration.
            </p>,
          ],
        },
        {
          heading: "Licences and plans",
          body: [
            <p key="a">
              A licence covers one business in the app, with every feature. Its plan follows the programme the business is set
              to: NP1, NP2, NP3 or Custom. Current prices are on the <Link href="/store/" className="underline">Store</Link> page.
            </p>,
            <p key="b">
              The NP1 plan is free for one person running the business with no staff. Once anyone else is invited to an NP1
              business, it needs the NP2 plan: we&apos;ll ask the business&apos;s admin to buy it, and may limit the business to
              read-only access until they do. Paid plans include the staff you invite to that business.
            </p>,
            <p key="c">
              If you change the programme a business follows, its plan changes to match from the next billing period. Moving to a
              lower-priced plan doesn&apos;t refund the period you&apos;ve already paid for.
            </p>,
            <p key="d">Licences are sold on this website, monthly or yearly, and renew automatically until cancelled. Prices are in New Zealand dollars and include GST.</p>,
            <p key="e">We may change prices, or what the free plan includes, by telling licence holders by email at least 30 days beforehand. A price change applies from your next renewal.</p>,
          ],
        },
        {
          heading: "Payment and renewal",
          body: [
            <p key="a">Payments are processed by Stripe. We never see or store your full card details.</p>,
            <p key="b">If a renewal payment fails, we&apos;ll let you know and may limit the business to read-only access until it&apos;s paid.</p>,
          ],
        },
        {
          heading: "Cancelling and refunds",
          body: [
            <p key="m">
              Money-back guarantee: if you ask within {pricing.moneyBackDays} days of the first payment for a business&apos;s licence,
              we&apos;ll refund that payment in full and end the licence. It applies once per business, to the first payment only.
            </p>,
            <p key="a">After that you can still cancel at any time. Your licence runs to the end of the period you&apos;ve paid for and isn&apos;t refunded for the unused part, unless the law requires it.</p>,
            <p key="b">When a licence ends, the business becomes read-only. Your records are not deleted: you can still view and export them, so you can meet your record-keeping obligations.</p>,
          ],
        },
        {
          heading: "Production, allergens and product details",
          body: [
            <p key="a">
              When you make a batch, JamPacked lists the allergens recorded on everything that went into it, and can fill in its
              use-by date from the shelf life you set on its recipe. Product details found by barcode may come from Open Food
              Facts, a public database that we don&apos;t control.
            </p>,
            <p key="b">
              These are aids, not checks. They are only as accurate as what was entered. You remain responsible for your
              recipes, ingredients, allergen declarations, date marks and labels on everything you make or sell, as the Food
              Standards Code requires.
            </p>,
          ],
        },
        {
          heading: "Your data",
          body: [
            <p key="a">The records you enter belong to your business. We use them only to provide JamPacked to you, as set out in our Privacy Policy.</p>,
            <p key="b">Records are kept for seven years and changes are logged, because food businesses must be able to show their records. You can export them at any time.</p>,
          ],
        },
        {
          heading: "Your responsibilities",
          body: [
            <p key="a">Keep your sign-in details safe, make sure the people you invite use JamPacked properly, and enter records accurately. Don&apos;t misuse the service, try to get into other businesses&apos; data, or interfere with how it runs.</p>,
            <p key="b">
              If you record information about other people, such as the customers you dispatch stock to or your suppliers&apos;
              contacts, you&apos;re responsible for being allowed to under the privacy law that applies to you. See our{" "}
              <Link href="/legal/privacy/" className="underline">Privacy Policy</Link>.
            </p>,
          ],
        },
        {
          heading: "Availability and changes",
          body: [
            <p key="a">We work to keep JamPacked available and your data backed up, but we can&apos;t promise it will never be interrupted. We may improve or change features; if a change takes away something important to you, you can cancel.</p>,
          ],
        },
        {
          heading: "Liability",
          body: [
            <p key="a">
              JamPacked is supplied for business purposes, so the Consumer Guarantees Act 1993 doesn&apos;t apply, as allowed by section 43 of that
              Act. Nothing in these terms limits rights under the Fair Trading Act 1986.
            </p>,
            <p key="b">
              To the extent the law allows, we&apos;re not liable for indirect or consequential loss, and our total liability for any claim is
              limited to what you paid for your licence in the 12 months before the claim.
            </p>,
          ],
        },
        {
          heading: "General",
          body: [
            <p key="a">These terms are governed by New Zealand law, and New Zealand courts have exclusive jurisdiction.</p>,
            <p key="b">We may update these terms. The date at the top shows the current version, and we&apos;ll tell licence holders by email before a significant change takes effect.</p>,
          ],
        },
      ]}
    />
  );
}
