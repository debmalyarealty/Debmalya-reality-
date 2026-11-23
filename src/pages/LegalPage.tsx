import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { applyDocumentMeta, buildSiteMetaTags } from '../lib/metaTags';
import { goBackOrFallback } from '../lib/motion';
import { BackButton } from '../components/BackButton';

interface LegalPageProps {
  type: 'privacy' | 'terms' | 'disclaimer';
}

export const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
  const { settings, user, enterOwnerWebsiteView } = useApp();
  const navigate = useNavigate();
  const phone = settings?.phone || '+91 86498 58954';
  const address =
    settings?.address ||
    'Sevoke Road, Ward Number 13, Dasrath Pally, Bhanu Nagar, Siliguri, West Bengal 734001.';

  const titles = {
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    disclaimer: 'Disclaimer',
  };

  const descriptions = {
    privacy:
      'Read how Debmalya Realty collects, safeguards, and uses personal details submitted via property inquiries, site visit bookings, and customer accounts.',
    terms:
      'Review terms governing property listings, pricing, site visit scheduling, and consultation services offered by Debmalya Realty in Siliguri.',
    disclaimer:
      'Important property consultation disclaimer covering specifications, availability, and on-site verification for Debmalya Realty listings.',
  };

  const paths = {
    privacy: '/privacy-policy',
    terms: '/terms',
    disclaimer: '/disclaimer',
  };

  useEffect(() => {
    applyDocumentMeta(
      buildSiteMetaTags({
        title: `${titles[type]} — Debmalya Realty`,
        description: descriptions[type],
        pathname: paths[type],
        image: settings?.hero_image_url,
        siteName: settings?.business_name,
      })
    );
  }, [type, settings]);

  return (
    <main className="pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-20 fluid-container min-h-[75vh]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <BackButton
            fallbackTo="/"
            label="Back"
            onClick={() => {
              if (user?.role === 'owner') {
                enterOwnerWebsiteView();
              }
              goBackOrFallback(navigate, '/', {
                skipPathPrefixes: [paths[type]],
              });
            }}
          />
        </div>

        <div className="rounded-[clamp(1.25rem,3vw,1.75rem)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-[clamp(1.25rem,4vw,2.5rem)] space-y-5">
          <h1 className="font-display text-[clamp(1.875rem,4vw,2.5rem)] font-semibold text-[var(--text-primary)]">
            {titles[type]}
          </h1>

          {type === 'privacy' && (
            <div className="space-y-4 text-base leading-relaxed text-[var(--text-secondary)] fluid-prose break-anywhere">
              <p>
                Debmalya Realty respects your privacy. Personal details submitted through our inquiry forms, site visit requests, customer account registration, or review submissions—such as your name, phone number, email address, and property preferences—are used solely to respond to your property or construction requests and manage your account.
              </p>
              <p>
                Customer account records, saved properties, and request histories are isolated per account. We do not sell your personal contact details to unrelated third parties.
              </p>
              <p>
                For data updates or account removal requests, contact our Siliguri office at {phone} or visit {address}
              </p>
            </div>
          )}

          {type === 'terms' && (
            <div className="space-y-4 text-base leading-relaxed text-[var(--text-secondary)] fluid-prose break-anywhere">
              <p>
                By accessing the Debmalya Realty website, you agree that property listings, pricing figures in Indian Rupees (₹), dimensions, and availability statuses are provided for informational consultation purposes and remain subject to direct verification during site visits and documentation review.
              </p>
              <p>
                Submitting a site visit request or a property booking request through this website initiates an owner review workflow and does not constitute a legally binding sale agreement, lease, or guaranteed reservation until formally confirmed in writing by Debmalya Realty.
              </p>
            </div>
          )}

          {type === 'disclaimer' && (
            <div className="space-y-4 text-base leading-relaxed text-[var(--text-secondary)] fluid-prose break-anywhere">
              <p>
                While Debmalya Realty strives to keep property availability, specifications, and locality details across Siliguri accurate and current, visual photographs, floor estimates, and sample portfolio listings are illustrative until verified on-site.
              </p>
              <p>
                Prospective buyers, tenants, and construction clients are encouraged to inspect properties in person and review all applicable municipal and legal documents directly with our office at {address} ({phone}).
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
