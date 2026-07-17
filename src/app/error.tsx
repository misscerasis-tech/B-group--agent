"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="content">
      <div className="state-box error">
        <h2>页面出错了</h2>
        <p>{error.message || "系统暂时无法完成请求。"}</p>
        <button className="button" onClick={reset} type="button">
          重试
        </button>
      </div>
    </div>
  );
}

