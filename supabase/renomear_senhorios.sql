-- Renomeia os 4 senhorios já semeados. Seguro: os dados importados referenciam
-- landlord_id (uuid), nunca o nome — renomear não parte nada. Idempotente.
update public.landlords set name = 'Miguel' where name = 'Avô';
update public.landlords set name = 'Eva' where name = 'Avó';
update public.landlords set name = 'António' where name = 'Pai';
update public.landlords set name = 'Ilidio' where name = 'Tio';

select name from public.landlords order by name;
