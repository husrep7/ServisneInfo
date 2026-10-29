export default function AdminPage({ title }: { title: string }) {
  return (
    <div className="admin-page">
      <h1 className="admin-page-title">{title}</h1>
    </div>
  );
}
