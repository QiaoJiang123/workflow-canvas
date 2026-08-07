export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
}

export const DEMO_PASSWORD = "123456";

export const DEMO_USERS: DemoUser[] = [
  {
    id: "user-qiao-admin",
    name: "Qiao Jiang",
    email: "qiao.admin@flowcanvas.demo",
    role: "Platform Owner",
    team: "AI Platform"
  },
  {
    id: "user-chad-gordon",
    name: "Chad Gordon",
    email: "chad.gordon@flowcanvas.demo",
    role: "Underwriting Approver",
    team: "Underwriting"
  },
  {
    id: "user-johann-sun",
    name: "Johann Sun",
    email: "johann.sun@flowcanvas.demo",
    role: "Data Engineering Lead",
    team: "Data Engineering"
  },
  {
    id: "user-chae-won-lee",
    name: "Chae Won Lee",
    email: "chae.won.lee@flowcanvas.demo",
    role: "Risk Reviewer",
    team: "Governance"
  }
];
