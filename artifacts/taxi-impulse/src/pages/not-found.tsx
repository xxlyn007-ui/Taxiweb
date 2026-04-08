import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">Страница не найдена</p>
        <Link href="/" className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
          На главную
        </Link>
      </div>
    </div>
  );
}
