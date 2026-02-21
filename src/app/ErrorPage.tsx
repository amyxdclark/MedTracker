import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

function isModuleLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // TypeError is thrown by browsers when a dynamic import fails.
  // The message varies across browsers, so check the error name and common keywords.
  return (
    error.name === 'TypeError' &&
    /module|import|script|fetch/i.test(error.message)
  );
}

export function ErrorPage() {
  const error = useRouteError();

  const moduleError = isModuleLoadError(error);

  const title = moduleError ? 'Failed to load page' : 'Something went wrong';
  const description = moduleError
    ? 'The application could not load a required script. This may be caused by a network issue or a recent update.'
    : isRouteErrorResponse(error)
    ? `${error.status} – ${error.statusText}`
    : error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-950 via-gray-950 to-black p-6 text-center">
      <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
        <span className="text-red-400 text-2xl font-bold">!</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-slate-400 mb-6 max-w-md">{description}</p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          Reload page
        </button>
        <button
          onClick={() => { window.location.href = '/MedTracker/'; }}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
