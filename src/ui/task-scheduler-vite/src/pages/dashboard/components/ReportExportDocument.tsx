import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Report } from '../../../services/types';

type ReportExportDocumentProps = {
  taskName: string;
  analysisGoal?: string;
  inputFilePath?: string;
  reportTitle: string;
  report: Report;
  createdAtLabel: string;
};

export default function ReportExportDocument(props: ReportExportDocumentProps) {
  const { taskName, analysisGoal, inputFilePath, reportTitle, report, createdAtLabel } = props;

  return (
    <article className="report-export-document">
      <header className="report-export-header">
        <div className="report-export-kicker">Task Report Export</div>
        <div className="report-export-hero">
          <div>
            <h1>{taskName}</h1>
            <p>{analysisGoal || '未补充任务目标说明。'}</p>
          </div>
          <div className="report-export-badges">
            <span>{reportTitle}</span>
            <span>{createdAtLabel}</span>
          </div>
        </div>
      </header>

      <section className="report-export-summary">
        <div className="report-export-summary-card">
          <span>关联运行</span>
          <strong>{report.runId}</strong>
        </div>
        <div className="report-export-summary-card">
          <span>输入文件</span>
          <strong>{inputFilePath || '未指定文件'}</strong>
        </div>
        <div className="report-export-summary-card">
          <span>报告编号</span>
          <strong>{report.id}</strong>
        </div>
      </section>

      <section className="report-export-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.contentMarkdown}</ReactMarkdown>
      </section>
    </article>
  );
}
