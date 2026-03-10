import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "product";
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = "mGift";
const BASE_URL = "https://mgift-vn.netlify.app";
const DEFAULT_DESCRIPTION =
  "mGift giúp bạn chọn quà hoàn hảo với AI thông minh, gom từ nhiều shop, đóng gói tinh tế và giao tận nơi.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export function SEO({ title, description, path = "", image, type = "website", jsonLd }: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Nền tảng tặng quà tinh tế`;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = `${BASE_URL}${path}`;
  const ogImage = image || DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="vi_VN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
