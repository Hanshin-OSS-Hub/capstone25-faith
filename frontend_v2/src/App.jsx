import React, { useState } from "react";
import HomeView from "./views/HomeView";
import AboutView from "./views/AboutView";
import Header from "./components/Header";
import Footer from "./components/Footer";

function App() {
  const [page, setPage] = useState("home"); // home | about | reports | verify

  return (
    <div className="min-h-screen bg-slate-50">
      <Header active={page} onNavigate={setPage} />

      {/* main은 스샷처럼 위아래 여백 넉넉하게 */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {page === "about" ? <AboutView /> : <HomeView />}
      </main>

      <Footer />
    </div>
  );
}

export default App;
