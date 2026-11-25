export type Department = {
    ulid: string;
    workspace_id: number;
    name: string;
    users_count?: number;
};

export type DepartmentUser = {
    id: number;
    name: string;
    email: string;
};
