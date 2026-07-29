import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Prose({ text }: { text: string }) {
  return (
    <div
      className="max-w-full text-[15px] leading-relaxed text-gray-800 [&_a]:text-blue-600 [&_a]:underline
      [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
      [&_li]:ml-4 [&_li]:list-disc [&_p+p]:mt-2 [&_strong]:font-semibold
      [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
      [&_th]:border-b [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold
      [&_td]:border-b [&_td]:border-gray-100 [&_td]:px-2 [&_td]:py-1.5
      dark:text-gray-200 dark:[&_a]:text-blue-400 dark:[&_code]:bg-white/10
      dark:[&_th]:border-gray-800 dark:[&_td]:border-gray-800/60"
    >
      <div className="overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}
