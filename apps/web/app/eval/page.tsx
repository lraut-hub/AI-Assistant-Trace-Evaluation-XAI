import { redirect } from 'next/navigation';

/** Legacy route — Eval Thinking renamed to Trace */
export default function EvalRedirectPage() {
  redirect('/trace');
}
