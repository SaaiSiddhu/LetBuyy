// S1/W4 render-parity harness — a minimal stand-in for next/navigation.
// useParams() outside a mounted Next.js App Router normally throws ("invariant expected app router to
// be mounted"). This harness renders an isolated section with no dynamic route, so an empty params
// object is the honest value — not a fabrication of route state that does not exist here.
export function useParams() {
  return {};
}
export function usePathname() {
  return '/';
}
export function useSearchParams() {
  return new URLSearchParams();
}
export function useRouter() {
  return { push() {}, replace() {}, back() {}, prefetch() {}, refresh() {} };
}
