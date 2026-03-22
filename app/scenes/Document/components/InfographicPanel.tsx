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
import LoadingIndicator from "~/components/LoadingIndicator";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import Sidebar from "./SidebarLayout";

function InfographicPanel() {
  const { ui, documents } = useStores();
  const { t } = useTranslation();
  const match = useRouteMatch<{ documentSlug: string }>();
  const document = documents.get(match.params.documentSlug);
  const { editor, isEditorInitialized } = useDocumentContext();

  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const generate = React.useCallback(async () => {
    if (!document) {
      return;
    }
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const res = await client.post("/infographic.create", {
        id: document.id,
      });
      setHtml(res.data.html);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Failed to generate infographic")
      );
    } finally {
      setLoading(false);
    }
  }, [document, t]);

  React.useEffect(() => {
    if (isEditorInitialized) {
      void generate();
    }
  }, [isEditorInitialized, generate]);

  const handleClose = React.useCallback(() => {
    ui.set({ rightSidebar: null });
  }, [ui]);

  return (
    <Sidebar
      title={t("Infographic")}
      onClose={handleClose}
      scrollable={false}
    >
      <Content column>
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
              srcDoc={html}
              sandbox="allow-scripts"
              title={t("Infographic")}
            />
            <RegenerateBar>
              <Button onClick={generate} neutral>
                {t("Regenerate")}
              </Button>
            </RegenerateBar>
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

const RegenerateBar = styled(Flex)`
  padding: 8px 12px;
  border-top: 1px solid ${s("divider")};
  justify-content: flex-end;
  flex-shrink: 0;
`;

export default observer(InfographicPanel);
