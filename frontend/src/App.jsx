import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import ScrollToTop from "./components/ScrollToTop";
import Footer from "./components/Footer";
import ErrorModal from "./components/ErrorModal";
import HomeView from "./views/HomeView";
import LoginView from "./views/LoginView";
import AboutView from "./views/AboutView";
import SignUpView from "./views/SignUpView";
import ArchiveView from "./views/ArchiveView";
import MyPageView from "./views/MyPageView";
import { useState } from "react";
import ResultView from "./views/ResultView";

export default function App() {
  const [error, setError] = useState(null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <ScrollToTop />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full dark:bg-slate-950">
        <Routes>
          <Route
            path="/"
            element={
              <HomeView
                onError={(t, m) => setError({ title: t, message: m })}
              />
            }
          />

          <Route path="/about" element={<AboutView />} />

          <Route
            path="/archive"
            element={<Navigate to="/archive/all/1" replace />}
          />
          <Route path="/archive/:category/:page" element={<ArchiveView />} />

          <Route
            path="/login"
            element={
              <LoginView
                onError={(t, m) => setError({ title: t, message: m })}
              />
            }
          />
          <Route
            path="/signup"
            element={
              <SignUpView
                onError={(t, m) => setError({ title: t, message: m })}
              />
            }
          />

          <Route path="/mypage" element={<MyPageView />} />

          <Route path="/result/archive/:archiveId" element={<ResultView />} />
          <Route path="/result" element={<ResultView />} />
        </Routes>
      </main>

      <Footer />

      <ErrorModal
        open={!!error}
        title={error?.title}
        message={error?.message}
        onClose={() => setError(null)}
      />
    </div>
  );
}
