import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-2">AirLIFT</h1>
      <p className="text-gray-600 mb-8">Dropzone manifest booking system</p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href="/register"
          className="bg-blue-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Jumper Registration
        </Link>
        <Link
          href="/login"
          className="bg-gray-800 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-gray-900 transition"
        >
          Staff Login
        </Link>
      </div>
    </div>
  );
}
