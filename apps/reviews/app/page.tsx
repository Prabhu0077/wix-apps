export default function OverviewPage() {
  return (
    <div>
      <h1>Overview</h1>
      <div className="stub-card">
        <span className="stub-tag">stub</span>
        <p>Reviews collected: <strong>0</strong></p>
        <p>Pending moderation: <strong>0</strong></p>
        <p>Plan: <strong>FREE</strong> (50 review requests / month)</p>
      </div>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        Data fetching not yet wired. See <code>docs/01_visual_ugc_reviews_mvp_spec.md</code> §7 for the build plan.
      </p>
    </div>
  );
}
