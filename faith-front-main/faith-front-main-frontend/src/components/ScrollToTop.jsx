import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** 경로가 바뀔 때마다 문서 스크롤을 맨 위로 (홈→아카이브 등) */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
