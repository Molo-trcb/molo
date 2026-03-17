import { observer } from "mobx-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import type Star from "~/models/Star";
import DelayedMount from "~/components/DelayedMount";
import Flex from "~/components/Flex";
import usePaginatedRequest from "~/hooks/usePaginatedRequest";
import useStores from "~/hooks/useStores";
import {
  useDropToCreateStar,
  useDropToReorderStar,
} from "../hooks/useDragAndDrop";
import DropCursor from "./DropCursor";
import Header from "./Header";
import PlaceholderCollections from "./PlaceholderCollections";
import Relative from "./Relative";
import SidebarLink from "./SidebarLink";
import StarredLink from "./StarredLink";

const STARRED_PAGINATION_LIMIT = 10;

function Starred() {
  const { stars } = useStores();
  const { t } = useTranslation();

  const { loading, next, end, error, page } = usePaginatedRequest<Star>(
    stars.fetchPage
  );
  const [reorderStarProps, dropToReorder] = useDropToReorderStar();
  const [createStarProps, dropToStarRef] = useDropToCreateStar();

  useEffect(() => {
    if (error) {
      toast.error(t("Could not load starred documents"));
    }
  }, [t, error]);

  return (
    <Flex column>
      <Header id="starred" title="Favoritos">
        <Relative>
          {reorderStarProps.isDragging && (
            <DropCursor
              isActiveDrop={reorderStarProps.isOverCursor}
              innerRef={dropToReorder}
              position="top"
            />
          )}
          {createStarProps.isDragging && (
            <DropCursor
              isActiveDrop={createStarProps.isOverCursor}
              innerRef={dropToStarRef}
              position="top"
            />
          )}
          {!loading && !stars.orderedData.length && (
            <EmptyHint>Marca documentos con ⭐ para verlos aquí</EmptyHint>
          )}
          {stars.orderedData
            .slice(0, page * STARRED_PAGINATION_LIMIT)
            .map((star) => (
              <StarredLink key={star.id} star={star} />
            ))}
          {!loading && !end && (
            <SidebarLink
              onClick={next}
              label={`${t("Show more")}…`}
              disabled={stars.isFetching}
              depth={0}
            />
          )}
          {loading && (
            <Flex column>
              <DelayedMount>
                <PlaceholderCollections />
              </DelayedMount>
            </Flex>
          )}
        </Relative>
      </Header>
    </Flex>
  );
}

const EmptyHint = styled.p`
  margin: 4px 0 4px 8px;
  font-size: 13px;
  color: ${(props) => props.theme.textTertiary};
`;

export default observer(Starred);
