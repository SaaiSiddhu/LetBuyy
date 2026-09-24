import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ReviewModerationActions } from '@/components/ReviewModerationActions';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import { AlertTriangle, ShieldAlert, Star } from '@letbuyy/ui';
import { LetbuyyApiError } from '@letbuyy/api-client';

export const metadata = {
    title: 'Review moderation — LetBuyy App Store',
    description: 'Ops review moderation queue for flagged marketplace app reviews.',
};

export default async function AppReviewModerationPage() {
    const result = await createAppMarketplaceApiClient({ requireSession: true })
        .then((api) => api.appStore.reviewModerationQueue({ limit: 100 }))
        .then((queue) => ({ authorized: true, reviews: queue.reviews || [] }))
        .catch((error) => {
            if (error instanceof LetbuyyApiError && (error.status === 401 || error.status === 403)) {
                return { authorized: false, reviews: [] };
            }
            return { authorized: true, reviews: [] };
        });

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="marketplace-card marketplace-section">
                    <div className="marketplace-section-header">
                        <h1>Review moderation</h1>
                        <p>Flagged and reported app reviews requiring marketplace operations review.</p>
                    </div>
                    {!result.authorized ? (
                        <div className="marketplace-banner marketplace-banner--warning">
                            <strong>Ops access required</strong>
                            <span>This queue is available only to authorized marketplace operators.</span>
                        </div>
                    ) : result.reviews.length > 0 ? (
                        <div className="moderation-review-list">
                            {result.reviews.map((review) => (
                                <article key={review.id} className="moderation-review-card">
                                    <div className="moderation-review-card__header">
                                        <ShieldAlert size={16} aria-hidden="true" />
                                        <div>
                                            <h2>{review.marketplace_apps?.name || 'Marketplace app'}</h2>
                                            <p>{review.title || 'Untitled review'}</p>
                                        </div>
                                        <span className="marketplace-badge marketplace-badge--warning">{review.status || 'flagged'}</span>
                                    </div>
                                    <p>{review.body || 'No body provided.'}</p>
                                    <div className="marketplace-row marketplace-row--wrap">
                                        <span className="marketplace-badge marketplace-badge--neutral">
                                            <Star size={12} aria-hidden="true" />
                                            {review.rating}
                                        </span>
                                        <span className="marketplace-badge marketplace-badge--neutral">
                                            {Number(review.reported_count || 0).toLocaleString()} reports
                                        </span>
                                        <span className="marketplace-badge marketplace-badge--neutral">
                                            Fraud score {Number(review.fraud_score || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    {review.fraud_flags.length > 0 && (
                                        <div className="app-permission-checklist">
                                            {review.fraud_flags.map((flag) => (
                                                <span key={flag}>
                                                    <AlertTriangle size={14} aria-hidden="true" />
                                                    {flag.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <ReviewModerationActions appId={review.app_id} reviewId={review.id} />
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="app-review-empty">
                            <div className="app-review-empty__icon">
                                <ShieldAlert size={20} aria-hidden="true" />
                            </div>
                            <h2>No flagged reviews</h2>
                            <p>No review reports or fraud flags are currently open.</p>
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
