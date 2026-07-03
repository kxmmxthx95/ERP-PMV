interface CalendarHeaderProps {
  // Add props if needed in the future
}

export default function CalendarHeader({}: CalendarHeaderProps) {
  // The header is currently simplified as a spacer to match the new design with floating capsule
  return <div className="hidden lg:block h-4" />;
}
