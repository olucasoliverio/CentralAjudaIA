import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../HelpCenter.css';

interface HelpCenterPreviewProps {
  content: string;
  title: string;
}

export const HelpCenterPreview: React.FC<HelpCenterPreviewProps> = ({ content, title }) => {
  // Pre-process content to handle those weird Next Fit asterisk-blocks from golden-articles
  const processedContent = content.replace(/\*{10,}([^]*?)\*{10,}/g, (_, p1) => {
    return `<div class="highlight-block">${p1.trim()}</div>`;
  });

  return (
    <div className="help-center-preview animate-fade-in">
      <h1>{title}</h1>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Allow HTML tags if we decide to use them in pre-processing
          div: ({ node, ...props }) => <div {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
