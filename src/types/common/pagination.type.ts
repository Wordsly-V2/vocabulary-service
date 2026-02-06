export type Pagination<T> = {
    items: T[];
    currentPageItems: number;
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
};
