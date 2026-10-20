import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://flowstar.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/app/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
