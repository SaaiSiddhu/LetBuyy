import { redirect } from 'next/navigation'

export default function HomePage() {
  // Redirect to lookup (progressive disclosure login)
  redirect('/lookup')
}
