import { requestUrl, type RequestUrlParam } from "obsidian";

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      titleSlug
      difficulty
      content
      similarQuestions
      topicTags {
        name
        slug
      }
    }
  }
`;

const SUBMISSION_LIST_QUERY = `
  query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
    questionSubmissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
      submissions {
        id
        statusDisplay
        lang
        runtime
        memory
        timestamp
      }
    }
  }
`;

const SUBMISSION_DETAIL_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      id
      code
      lang {
        name
        verboseName
      }
      runtime
      runtimeDisplay
      memory
      memoryDisplay
      timestamp
    }
  }
`;

export interface SimilarQuestion {
  title: string;
  slug: string;
  difficulty: string;
}

export interface QuestionMetadata {
  id?: string;
  number?: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: string[];
  content?: string;
  similarQuestions: SimilarQuestion[];
}

export interface SubmissionSolution {
  id: string;
  code: string;
  lang?: string;
  runtime?: string;
  memory?: string;
  timestamp?: number;
}

export async function fetchQuestion(
  titleSlug: string,
  cookie: string
): Promise<QuestionMetadata> {
  const headers = buildHeaders({ titleSlug, cookie });

  const request: RequestUrlParam = {
    url: "https://leetcode.com/graphql",
    method: "POST",
    body: JSON.stringify({
      query: QUESTION_QUERY,
      variables: { titleSlug }
    }),
    headers,
    throw: false
  };

  const response = await requestUrl(request);

  if (response.status !== 200) {
    throw new Error(`LeetCode вернул статус ${response.status}`);
  }

  const payload = (response.json as any) ?? JSON.parse(response.text);
  const question = payload?.data?.question;
  if (!question) {
    throw new Error("Не удалось получить данные задачи (возможно, устаревший cookie)");
  }

  const tags: string[] =
    question.topicTags?.map((tag: { name?: string }) => tag?.name).filter(Boolean) ?? [];

  return {
    id: question.questionId ?? undefined,
    number: question.questionFrontendId ?? question.questionId ?? undefined,
    title: question.title ?? titleSlug,
    slug: question.titleSlug ?? titleSlug,
    difficulty: question.difficulty ?? "Unknown",
    tags,
    content: question.content ?? "",
    similarQuestions: parseSimilarQuestions(question.similarQuestions)
  };
}

function parseSimilarQuestions(raw: unknown): SimilarQuestion[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        title: item.title as string,
        slug: item.titleSlug as string,
        difficulty: item.difficulty as string
      }))
      .filter((q) => q.title && q.slug);
  } catch (error) {
    console.warn("Не удалось распарсить similarQuestions", error);
    return [];
  }
}

export async function fetchSlugByNumber(
  frontendQuestionId: string,
  cookie: string
): Promise<string | null> {
  const response = await requestUrl({
    url: "https://leetcode.com/api/problems/all/",
    method: "GET",
    headers: buildHeaders({ titleSlug: "", cookie })
  });

  if (response.status !== 200) {
    console.warn("Не удалось получить список задач по номеру", response.status);
    return null;
  }

  const payload = (response.json as any) ?? JSON.parse(response.text);
  const items: any[] = payload?.stat_status_pairs ?? [];
  const target = items.find(
    (item) => String(item?.stat?.frontend_question_id) === String(frontendQuestionId)
  );
  const slug = target?.stat?.question__title_slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

export async function fetchLatestAcceptedSolution(
  titleSlug: string,
  cookie: string
): Promise<SubmissionSolution | null> {
  const solutions = await fetchAcceptedSolutions(titleSlug, cookie, { limit: 1 });
  return solutions[0] ?? null;
}

export async function fetchAcceptedSolutions(
  titleSlug: string,
  cookie: string,
  options: { limit?: number } = {}
): Promise<SubmissionSolution[]> {
  const { limit = 20 } = options;
  const headers = buildHeaders({ titleSlug, cookie });
  const submissions = await fetchAcceptedSubmissions(titleSlug, headers, limit);
  if (!submissions.length) return [];

  const results: SubmissionSolution[] = [];
  for (const submission of submissions) {
    const detail = await fetchSubmissionDetails(submission, { cookie, titleSlug });
    if (detail?.code) {
      results.push(detail);
    }
  }

  return results;
}

async function fetchAcceptedSubmissions(
  titleSlug: string,
  headers: Record<string, string>,
  limit: number
): Promise<
  { id: string; lang?: string; runtime?: string; memory?: string; timestamp?: number }[]
> {
  const fallback = await requestUrl({
      url: "https://leetcode.com/graphql",
      method: "POST",
      body: JSON.stringify({
        query: SUBMISSION_LIST_QUERY,
        variables: { offset: 0, limit, questionSlug: titleSlug }
      }),
      headers,
      throw: false
    });

  let submissions: any[] = [];
  if (fallback.status === 200) {
    const fallbackPayload = (fallback.json as any) ?? JSON.parse(fallback.text);
    submissions = fallbackPayload?.data?.questionSubmissionList?.submissions ?? [];
  } else {
    console.warn("questionSubmissionList status", {
      status: fallback.status,
      text: fallback.text?.slice(0, 400)
    });
  }

  if (!Array.isArray(submissions) || submissions.length === 0) {
    console.warn("submissions list is empty");
    return [];
  }

  const accepted = submissions
    .filter((s) => s?.statusDisplay === "Accepted")
    .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

  return accepted.map((item) => ({
    id: String(item.id),
    lang: item.lang,
    runtime: item.runtime,
    memory: item.memory,
    timestamp: item.timestamp ? Number(item.timestamp) : undefined
  }));
}

async function fetchSubmissionDetails(
  submission: {
    id: string;
    lang?: string;
    runtime?: string;
    memory?: string;
    timestamp?: number;
  },
  params: { cookie: string; titleSlug: string }
): Promise<SubmissionSolution | null> {
  const { cookie, titleSlug } = params;

  const detailHeaders = buildHeaders({
    titleSlug,
    cookie,
    referer: `https://leetcode.com/submissions/detail/${submission.id}/`
  });

  const detailResponse = await requestUrl({
    url: "https://leetcode.com/graphql",
    method: "POST",
    body: JSON.stringify({
      query: SUBMISSION_DETAIL_QUERY,
      variables: { submissionId: Number(submission.id) }
    }),
    headers: detailHeaders,
    throw: false
  });

  if (detailResponse.status !== 200) {
    console.warn("Не удалось получить детали сабмита", {
      status: detailResponse.status,
      text: detailResponse.text?.slice(0, 400)
    });
    return null;
  }

  const detailPayload = (detailResponse.json as any) ?? JSON.parse(detailResponse.text);
  const details = detailPayload?.data?.submissionDetails;
  if (!details?.code) return null;

  return {
    id: String(details.id ?? submission.id),
    code: details.code,
    lang: details.lang?.name ?? submission.lang,
    runtime: details.runtimeDisplay ?? details.runtime ?? submission.runtime,
    memory: details.memoryDisplay ?? details.memory ?? submission.memory,
    timestamp: details.timestamp ?? submission.timestamp
  };
}

function buildHeaders(params: {
  titleSlug: string;
  cookie: string;
  referer?: string;
}): Record<string, string> {
  const { titleSlug, cookie, referer } = params;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    referer: referer ?? `https://leetcode.com/problems/${titleSlug}/`,
    origin: "https://leetcode.com",
    "x-requested-with": "XMLHttpRequest"
  };

  const trimmed = cookie?.trim();
  if (trimmed) {
    headers.Cookie = trimmed;
    const csrf = extractCookie(trimmed, "csrftoken");
    if (csrf) headers["x-csrftoken"] = csrf;
  }

  return headers;
}

function extractCookie(cookieHeader: string, key: string): string | null {
  const match = cookieHeader.match(new RegExp(`${key}=([^;\\s]+)`));
  return match ? match[1] ?? null : null;
}

