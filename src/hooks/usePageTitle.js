import { useEffect } from 'react'

const SITE_NAME = 'PrintGet'
const SITE_URL = 'https://www.printget.in'
const DEFAULT_DESCRIPTION =
    'Upload your documents and get them printed at your nearest local print shop in Bangalore. Fast, easy, and affordable online printing service.'

const setMeta = (selector, attr, value) => {
    if (typeof document === 'undefined') return
    let el = document.head.querySelector(selector)
    if (!el) {
        el = document.createElement('meta')
        const [, name] = selector.match(/\[([^=]+)="([^"]+)"\]/) || []
        const m = selector.match(/\[(name|property)="([^"]+)"\]/)
        if (m) {
            el.setAttribute(m[1], m[2])
        }
        document.head.appendChild(el)
    }
    el.setAttribute(attr, value)
}

const setCanonical = (url) => {
    if (typeof document === 'undefined') return
    let el = document.head.querySelector('link[rel="canonical"]')
    if (!el) {
        el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        document.head.appendChild(el)
    }
    el.setAttribute('href', url)
}

/**
 * Hook to set page title + SEO meta dynamically.
 * Accepts either a string (title only) or an object: { title, description, path }
 */
export const usePageTitle = (input) => {
    useEffect(() => {
        const prevTitle = document.title

        const opts = typeof input === 'string' ? { title: input } : (input || {})
        const { title, description, path } = opts

        const fullTitle = title ? `${SITE_NAME} - ${title}` : SITE_NAME
        const desc = description || DEFAULT_DESCRIPTION
        const canonicalPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/')
        const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`

        document.title = fullTitle

        setMeta('meta[name="description"]', 'content', desc)
        setMeta('meta[name="title"]', 'content', fullTitle)
        setMeta('meta[property="og:title"]', 'content', fullTitle)
        setMeta('meta[property="og:description"]', 'content', desc)
        setMeta('meta[property="og:url"]', 'content', canonicalUrl)
        setMeta('meta[name="twitter:title"]', 'content', fullTitle)
        setMeta('meta[name="twitter:description"]', 'content', desc)
        setMeta('meta[name="twitter:url"]', 'content', canonicalUrl)
        setCanonical(canonicalUrl)

        return () => {
            document.title = prevTitle
        }
    }, [input])
}
