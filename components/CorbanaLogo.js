export default function CorbanaLogo({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21C7 21 3 17.5 3 12.5C3 7 7.5 3 13 3C13 9 9.5 12.5 5 13.5C7.5 15.5 11 16 12 21Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
