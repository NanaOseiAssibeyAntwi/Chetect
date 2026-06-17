import { supabase } from '@/lib/supabase';

type SyncExamLifecycleRow = {
  exams_marked_completed: number | null;
  exams_marked_live: number | null;
  registrations_marked_terminal: number | null;
  sessions_marked_terminal: number | null;
};

function isMissingLifecycleRpcError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (!normalizedMessage.includes('sync_exam_lifecycle_statuses')) {
    return false;
  }

  return (
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes('could not find the function') ||
    normalizedMessage.includes('schema cache') ||
    normalizedMessage.includes('no function matches')
  );
}

export async function syncExamLifecycleStatuses() {
  const { data, error } = await supabase
    .rpc('sync_exam_lifecycle_statuses')
    .returns<SyncExamLifecycleRow[]>();

  if (error) {
    // Keep older deployed schemas backward compatible while migrations are catching up.
    if (error.code === 'PGRST202' || isMissingLifecycleRpcError(String(error.message ?? ''))) {
      return null;
    }

    throw new Error(`Unable to sync exam lifecycle: ${error.message}`);
  }

  return Array.isArray(data) ? (data[0] ?? null) : null;
}
