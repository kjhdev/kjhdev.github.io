/**
 * 게시글의 category 값을 URL에서 사용할 slug로 변환한다.
 *
 * 예:
 * Flutter -> flutter
 * Web Development -> web-development
 * Spring Boot -> spring-boot
 */
export function categoryToSlug(category: string) {
  return category
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
