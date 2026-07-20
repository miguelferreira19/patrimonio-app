"use client";

import { useAction } from "@/components/forms";
import { Card, Select, Table, Td, Th } from "@/components/ui";
import { setProfileRole } from "@/lib/actions/crud";
import type { Profile, Role } from "@/lib/types";

function ProfileRoleSelect({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <Select
        value={profile.role}
        disabled={isMe || pending}
        onChange={(e) => run(setProfileRole({ id: profile.id, role: e.target.value as Role }))}
        className="w-36"
      >
        <option value="admin">Administrador</option>
        <option value="viewer">Leitura</option>
      </Select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function UsersCard({ profiles, meId }: { profiles: Profile[]; meId: string }) {
  return (
    <Card title="Utilizadores">
      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Nome</Th>
            <Th>Papel</Th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50">
              <Td>{p.email ?? "n/d"}</Td>
              <Td>{p.display_name ?? "n/d"}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <ProfileRoleSelect profile={p} isMe={p.id === meId} />
                  {p.id === meId && <span className="text-xs text-zinc-400">és tu</span>}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-zinc-500">
        Para criar novos acessos: Supabase → Authentication → Add user.
      </p>
    </Card>
  );
}
