// Product identity in one place. The public app name is still open
// (PRD v2, Q1) — change PRODUCT_NAME here once it is decided.
//
// Design rule: the dashboard looks native to the Wix dashboard; the
// storefront widget and the review form look like the merchant's store.
// Bodham Labs appears only as the maker credit and on legal pages.

export const PRODUCT_NAME = "Product Reviews";
export const MAKER_NAME = "Bodham Labs";
export const MAKER_URL = "https://bodhamlabs.com";
export const MAKER_LOCATION = "Delhi, India";
export const SUPPORT_EMAIL = "support@bodhamlabs.com";
export const PRIVACY_EMAIL = "security@bodhamlabs.com";

/** Review links stay valid this long after the request is created. */
export const REVIEW_LINK_DAYS = 60;

/** Default star colour on the storefront; merchants can change it. */
export const DEFAULT_STAR_COLOR = "#F5A623";
