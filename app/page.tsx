import { redirect } from 'next/navigation';

/** The dashboard has one home: the daily report across every source. */
export default function Page() {
  redirect('/usage/daily/all');
}
