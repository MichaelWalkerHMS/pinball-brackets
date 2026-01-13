import NavLinks from "./NavLinks";
import SettingsButton from "./SettingsButton";
import AuthHeader from "./AuthHeader";
import MobileAuthHeader from "./MobileAuthHeader";
import MobileNav from "./MobileNav";
import FeedbackButton from "./FeedbackButton";

export default async function ResponsiveHeader() {
  return (
    <>
      {/* Desktop navigation - hidden on mobile */}
      <div className="hidden sm:flex items-center gap-2">
        <NavLinks />
        <FeedbackButton variant="desktop" />
        <SettingsButton />
        <AuthHeader />
      </div>

      {/* Mobile navigation - visible only on small screens */}
      <MobileNav>
        <MobileAuthHeader />
      </MobileNav>
    </>
  );
}
