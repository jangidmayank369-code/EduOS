export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-blue-600">
          EduOS
        </h1>

        <p className="mt-4 text-lg text-slate-600">
          AI-Powered School Management Platform
        </p>

        <button className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">
          Login
        </button>
      </div>
    </main>
  );
}