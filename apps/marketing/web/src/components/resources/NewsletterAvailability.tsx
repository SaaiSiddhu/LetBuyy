
import Copy from '@/components/i18n/Copy'
import Link from '@/components/i18n/LocaleLink'

export default function NewsletterAvailability() {
    return (
        <div className="nlx-availability">
            <p><Copy text={"Email subscriptions are not available yet. Follow new guides with your RSS reader."} /></p>
            <Link href="/resources/rss.xml" className="btn btn-outline"><Copy text={"Follow via RSS"} /></Link>
        </div>
    )
}
