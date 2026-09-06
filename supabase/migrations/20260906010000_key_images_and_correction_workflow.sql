-- Key images and field-level correction requests are stored inside the existing
-- worksheet JSON payload so they remain versioned with the clinical worksheet.
-- This policy update lets the assigned reviewer persist review metadata while
-- preserving organization and assignment boundaries.

DROP POLICY IF EXISTS "Draft owners can update worksheets" ON public.worksheets;

CREATE POLICY "Clinical staff can update allowed worksheets"
  ON public.worksheets FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR user_id = auth.uid()
      OR sonographer_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.studies s
        WHERE s.id = worksheets.study_id
          AND s.organization_id = worksheets.organization_id
          AND s.assigned_to = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR user_id = auth.uid()
      OR sonographer_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.studies s
        WHERE s.id = worksheets.study_id
          AND s.organization_id = worksheets.organization_id
          AND s.assigned_to = auth.uid()
      )
    )
  );
