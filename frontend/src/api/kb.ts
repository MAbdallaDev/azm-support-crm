import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type {
  KBArticleDetail,
  KBArticleListRow,
  KBArticleWrite,
  KBCategory,
  Paginated,
} from "./types";

/**
 * Knowledge base data access.
 *
 * `lookup_field = "slug"` on the backend — every article route is by slug,
 * never by id (`kb/articles/<slug>/`). `useKBArticle` and the two mutations
 * below all key on it for that reason.
 *
 * **Neither mutation seeds the detail cache from its own response.**
 * `KBArticleViewSet.get_serializer_class()` returns `KBArticleWriteSerializer`
 * for both "create" and "update" — a narrower shape than
 * `KBArticleDetailSerializer`, missing `has_arabic`, `view_count`,
 * `author_name` and `updated_at`. Story 07's ticket mutations get to seed
 * their cache from the response because every ticket action explicitly
 * returns `TicketDetailSerializer`; the KB write endpoints do not carry that
 * same guarantee, so writing their response straight into `qk.kb.detail`
 * would poison it with those fields `undefined` — and the reader renders
 * `updated_at` through `formatRelative` on its very first paint.
 */

const REFERENCE_STALE_MS = 5 * 60 * 1000;

export const useKBCategories = () =>
  useQuery({
    queryKey: qk.kb.categories,
    queryFn: () => api.get<KBCategory[]>("/kb/categories/").then((r) => r.data),
    staleTime: REFERENCE_STALE_MS,
  });

export const useKBArticles = (params: URLSearchParams) => {
  const key = params.toString();

  return useQuery({
    queryKey: qk.kb.list(key),
    queryFn: () =>
      api.get<Paginated<KBArticleListRow>>(`/kb/articles/?${key}`).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
};

export const useKBArticle = (slug: string | null) =>
  useQuery({
    queryKey: qk.kb.detail(slug ?? ""),
    queryFn: () => api.get<KBArticleDetail>(`/kb/articles/${slug}/`).then((r) => r.data),
    enabled: slug !== null,
  });

export const useCreateArticle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: KBArticleWrite) =>
      api.post<{ slug: string }>("/kb/articles/", body).then((r) => r.data),
    onSuccess: (article) => {
      // Invalidate rather than seed — see the module docstring.
      void queryClient.invalidateQueries({ queryKey: qk.kb.detail(article.slug) });
      void queryClient.invalidateQueries({ queryKey: qk.kb.all });
    },
  });
};

export const useUpdateArticle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, ...body }: { slug: string } & Partial<KBArticleWrite>) =>
      api.patch<{ slug: string }>(`/kb/articles/${slug}/`, body).then((r) => r.data),
    onSuccess: (article, variables) => {
      // The slug can change on the write path in principle (create's slug is
      // editable); the editor itself freezes it once an article exists, but
      // the cache cleanup here follows whatever the server actually returns.
      if (variables.slug !== article.slug) {
        queryClient.removeQueries({ queryKey: qk.kb.detail(variables.slug) });
      }
      void queryClient.invalidateQueries({ queryKey: qk.kb.detail(article.slug) });
      void queryClient.invalidateQueries({ queryKey: qk.kb.all });
    },
  });
};

export const useMarkHelpful = () =>
  useMutation({
    mutationFn: (slug: string) =>
      api.post<{ helpful_count: number }>(`/kb/articles/${slug}/helpful/`).then((r) => r.data),
  });
