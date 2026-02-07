import { useEffect } from 'react'

/**
 * Hook to set the page title dynamically
 * @param {string} title - The title to set (will be prefixed with "PrintGet - " if not the home page)
 */
export const usePageTitle = (title) => {
    useEffect(() => {
        const prevTitle = document.title

        if (title) {
            document.title = `PrintGet - ${title}`
        } else {
            document.title = 'PrintGet'
        }

        // Cleanup: revert to previous title when component unmounts
        return () => {
            document.title = prevTitle
        }
    }, [title])
}
