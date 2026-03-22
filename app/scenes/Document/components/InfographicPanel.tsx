import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useRouteMatch } from "react-router-dom";
import styled from "styled-components";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import { useDocumentContext } from "~/components/DocumentContext";
import Empty from "~/components/Empty";
import Flex from "~/components/Flex";
import InputSelect, { type Item } from "~/components/InputSelect";
import LoadingIndicator from "~/components/LoadingIndicator";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import Sidebar from "./SidebarLayout";

const STYLE_OPTIONS: Item[] = [
  { type: "item", value: "modern", label: "Moderno" },
  { type: "item", value: "corporate", label: "Corporativo" },
  { type: "item", value: "minimal", label: "Minimalista" },
  { type: "item", value: "colorful", label: "Colorido" },
  { type: "item", value: "dark", label: "Oscuro" },
];

function InfographicPanel() {
  const { ui, documents } = useStores();
  const { t } = useTranslation();
  const match = useRouteMatch<{ documentSlug: string }>();
  const document = documents.get(match.params.documentSlug);
  const { isEditorInitialized } = useDocumentContext();
  const documentContext = useDocumentContext();

  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const generate = React.useCallback(async () => {
    if (!document) {
      return;
    }
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      // Read editor from context object at call time (editor is not @observable)
      const text = documentContext.editor
        ? (documentContext.editor.value() as string)
        : undefined;
      const res = await client.post("/infographic.create", {
        id: document.id,
        text,
        style: ui.infographicStyle,
      });
      setHtml(res.data.html);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Failed to generate infographic")
      );
    } finally {
      setLoading(false);
    }
  }, [document, documentContext, ui, t]);

  React.useEffect(() => {
    if (isEditorInitialized) {
      void generate();
    }
  }, [isEditorInitialized, generate]);

  const handleClose = React.useCallback(() => {
    ui.set({ rightSidebar: null });
  }, [ui]);

  const handleStyleChange = React.useCallback(
    (value: string) => {
      ui.set({ infographicStyle: value });
    },
    [ui]
  );

  const handleDownloadHTML = React.useCallback(() => {
    if (!html || !document) {
      return;
    }
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.title}-infographic.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [html, document]);

  const handleExportPDF = React.useCallback(() => {
    iframeRef.current?.contentWindow?.print();
  }, []);

  const handleExportPNG = React.useCallback(async () => {
    if (!html || !document) {
      return;
    }
    const { default: html2canvas } = await import("html2canvas");
    const container = window.document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:0;width:900px;background:#fff";
    container.innerHTML = html;
    window.document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.title}-infographic.png`;
      a.click();
    } finally {
      window.document.body.removeChild(container);
    }
  }, [html, document]);

  return (
    <Sidebar
      title={t("Infographic")}
      onClose={handleClose}
      scrollable={false}
    >
      <Content column>
        <StyleBar align="center" gap={8}>
          <StyleLabel>{t("Theme")}</StyleLabel>
          <StyleSelectWrapper>
            <InputSelect
              options={STYLE_OPTIONS}
              value={ui.infographicStyle}
              onChange={handleStyleChange}
            />
          </StyleSelectWrapper>
        </StyleBar>
        {loading && (
          <Centered column>
            <LoadingIndicator />
            <Empty>{t("Generating infographic…")}</Empty>
          </Centered>
        )}
        {error && !loading && (
          <Centered column gap={12}>
            <Empty>{error}</Empty>
            <Button onClick={generate} neutral>
              {t("Retry")}
            </Button>
          </Centered>
        )}
        {html && !loading && (
          <>
            <StyledIframe
              ref={iframeRef}
              srcDoc={html}
              sandbox="allow-scripts allow-modals"
              title={t("Infographic")}
            />
            <ActionBar align="center" justify="space-between">
              <Button onClick={generate} neutral>
                {t("Regenerate")}
              </Button>
              <ExportButtons gap={4}>
                <Button onClick={handleDownloadHTML} neutral>
                  HTML
                </Button>
                <Button onClick={handleExportPDF} neutral>
                  PDF
                </Button>
                <Button onClick={handleExportPNG} neutral>
                  PNG
                </Button>
              </ExportButtons>
            </ActionBar>
          </>
        )}
      </Content>
    </Sidebar>
  );
}

const Content = styled(Flex)`
  flex: 1;
  overflow: hidden;
  height: 100%;
`;

const StyleBar = styled(Flex)`
  padding: 8px 12px;
  border-bottom: 1px solid ${s("divider")};
  flex-shrink: 0;
`;

const StyleLabel = styled.span`
  font-size: 13px;
  color: ${s("textSecondary")};
  white-space: nowrap;
`;

const StyleSelectWrapper = styled.div`
  flex: 1;
`;

const Centered = styled(Flex)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
`;

const StyledIframe = styled.iframe`
  flex: 1;
  width: 100%;
  border: none;
`;

const ActionBar = styled(Flex)`
  padding: 8px 12px;
  border-top: 1px solid ${s("divider")};
  flex-shrink: 0;
`;

const ExportButtons = styled(Flex)``;

export default observer(InfographicPanel);
