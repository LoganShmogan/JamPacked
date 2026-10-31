import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { legalDocs } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata(
  legalDocs.privacy.href,
  legalDocs.privacy.title,
  "How JamPacked collects, uses, stores and protects personal information under the New Zealand Privacy Act 2020.",
);

// Draft; list each service provider (and where it stores data) as it's added. Have a NZ lawyer review
// before launch (docs/issues/legal-documents.md), and change the date whenever the wording changes.
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={legalDocs.privacy.updated}
      intro={
        <p>
          {site.company} runs JamPacked and is responsible for the personal information it holds. We follow the New Zealand
          Privacy Act 2020 and, for Australian customers, the Australian Privacy Principles.
        </p>
      }
      sections={[
        {
          heading: "What we collect",
          body: [
            <ul key="a" className="list-disc space-y-1 pl-5">
              <li><strong>Account details:</strong> name, email address and the businesses and roles you belong to.</li>
              <li><strong>Business details:</strong> business name, address, country and region, and registration number.</li>
              <li><strong>Records you enter:</strong> deliveries, stock, your product catalogue, recipes and production batches, temperatures, programme records and audits, including the name of the person who entered or changed each one.</li>
              <li><strong>People your business deals with:</strong> supplier contact details and the names of customers stock is dispatched to, as your business enters them. JamPacked remembers them so they can be picked again instead of retyped.</li>
              <li><strong>Purchases:</strong> who bought a paid licence, which plan and when. The free NP1 plan involves no payment. Card details go straight to Stripe; we don&apos;t see them.</li>
              <li><strong>Messages:</strong> what you send us by email.</li>
              <li><strong>Website use:</strong> if analytics are on, which pages are visited, without cookies (see the <Link href="/legal/cookies/" className="underline">Cookies &amp; data policy</Link>).</li>
            </ul>,
          ],
        },
        {
          heading: "Information about other people",
          body: [
            <p key="a">
              Supplier and customer details are held on behalf of the business that entered them, and used only to provide
              JamPacked to that business: to trace food back to where it came from and on to where it went, as food safety rules
              require. The business is responsible for being allowed to record them. If one of those people asks us about their
              information, we&apos;ll pass the request to the business and help it respond.
            </p>,
          ],
        },
        {
          heading: "How we use it",
          body: [
            <p key="a">To run JamPacked for your business, sign you in, take payment, answer your questions, keep the service secure, and improve it. We don&apos;t sell personal information or use your records for advertising.</p>,
          ],
        },
        {
          heading: "Who we share it with",
          body: [
            <p key="a">The people in your business can see the records for that business, according to their role. Otherwise we only share information with providers that help us run JamPacked, such as Stripe for payments, and only for that purpose, or when the law requires it.</p>,
            <p key="b">When you scan a barcode that isn&apos;t in your catalogue, the barcode number, and nothing else, is sent to Open Food Facts to look the product up.</p>,
          ],
        },
        {
          heading: "Storage and security",
          body: [
            <p key="a">Data is stored in our database and sent over encrypted connections. Access is limited to the people who run JamPacked. We back up data so records aren&apos;t lost, and we&apos;ll tell you where your data is stored on request.</p>,
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            <p key="a">Food safety records and their change history are kept for seven years, because businesses must be able to produce them. Account details are kept while you use JamPacked and as long as they&apos;re attached to records we must keep. Emails are kept for up to 24 months.</p>,
          ],
        },
        {
          heading: "Your rights",
          body: [
            <p key="a">
              You can ask to see or correct the personal information we hold about you, or ask us to close your account. Email{" "}
              <a href={`mailto:${site.email}`} className="underline">{site.email}</a>. Where records must be kept, we may keep your name on them
              but remove your access. If you&apos;re not happy with our response, you can complain to the Office of the Privacy
              Commissioner (<a href="https://www.privacy.org.nz" className="underline">privacy.org.nz</a>).
            </p>,
          ],
        },
        {
          heading: "Changes",
          body: [<p key="a">We may update this policy. The date at the top shows the current version.</p>],
        },
      ]}
    />
  );
}
