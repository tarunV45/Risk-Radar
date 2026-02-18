export default function NewRepoPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Add repo</h1>

      <form className="space-y-3" action="/api/new" method="post">
        <div>
          <label className="block text-sm">Name</label>
          <input name="name" className="border rounded p-2 w-full" required />
        </div>

        <div>
          <label className="block text-sm">Local path</label>
          <input name="localPath" className="border rounded p-2 w-full" required />
        </div>

        <button className="border rounded px-4 py-2">Create</button>
      </form>
    </main>
  );
}
