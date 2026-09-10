import { useEffect } from 'react'
export default function LoadingScreen({ lang, onComplete }) {
  useEffect(() => { const timer = setTimeout(() => onComplete?.(), 160); return () => clearTimeout(timer) }, [onComplete])
  return <div className="ui-loading-screen" role="status"><div className="ui-spinner" /><p>{lang === 'he' ? 'מכינים את הדייט שלכם…' : 'Finding your date…'}</p></div>
}
