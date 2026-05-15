-- Update the dashboard metrics function to include checked-in counts per category for the check-in report.
CREATE OR REPLACE FUNCTION get_admin_dashboard_data(
  p_date_filter TEXT DEFAULT 'All Time',
  p_type_filter TEXT DEFAULT 'All Types',
  p_org_filter TEXT DEFAULT 'All Organisers',
  p_funds_filter TEXT DEFAULT 'All Destinations'
)
RETURNS JSON AS $$
DECLARE
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_metrics JSON;
  v_leaderboard JSON;
  v_chart_data JSON;
  v_whatsapp JSON;
BEGIN
  -- 1. Determine Start Date based on filter
  IF p_date_filter = 'Today' THEN
    v_start_date := CURRENT_DATE;
  ELSIF p_date_filter = 'Last 7 Days' THEN
    v_start_date := NOW() - INTERVAL '7 days';
  ELSIF p_date_filter = 'This Month' THEN
    v_start_date := DATE_TRUNC('month', NOW());
  ELSE
    v_start_date := '1970-01-01'::TIMESTAMP WITH TIME ZONE;
  END IF;

  -- 2. Calculate Metrics
  WITH filtered_tickets AS (
    SELECT * FROM tickets
    WHERE created_at >= v_start_date
      AND (p_type_filter = 'All Types' OR type = p_type_filter)
      AND (p_org_filter = 'All Organisers' OR sold_by ILIKE p_org_filter)
      AND (p_funds_filter = 'All Destinations' OR funds_destination = LOWER(p_funds_filter))
  )
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(CASE WHEN status != 'cancelled' THEN price * quantity ELSE 0 END), 0),
    'trust_revenue', COALESCE(SUM(CASE WHEN status != 'cancelled' AND funds_destination = 'trust' THEN price * quantity ELSE 0 END), 0),
    'organizer_revenue', COALESCE(SUM(CASE WHEN status != 'cancelled' AND funds_destination = 'organizer' THEN price * quantity ELSE 0 END), 0),
    'total_tickets', COALESCE(SUM(CASE WHEN status != 'cancelled' THEN quantity ELSE 0 END), 0),
    'scannable_tickets', COALESCE(SUM(CASE WHEN status != 'cancelled' AND type NOT ILIKE '%donor%' THEN quantity ELSE 0 END), 0),
    'checked_in', COALESCE(SUM(CASE WHEN status != 'cancelled' AND type NOT ILIKE '%donor%' THEN checked_in_count ELSE 0 END), 0),
    'cancelled_count', COALESCE(SUM(CASE WHEN status = 'cancelled' THEN quantity ELSE 0 END), 0)
  ) INTO v_metrics
  FROM filtered_tickets;

  -- 3. Leaderboard Data (Updated to include checked-in counts)
  WITH filtered_tickets AS (
    SELECT * FROM tickets
    WHERE created_at >= v_start_date
      AND (p_type_filter = 'All Types' OR type = p_type_filter)
      AND (p_org_filter = 'All Organisers' OR sold_by ILIKE p_org_filter)
      AND (p_funds_filter = 'All Destinations' OR funds_destination = LOWER(p_funds_filter))
  )
  SELECT json_agg(t) INTO v_leaderboard
  FROM (
    SELECT 
      sold_by as name,
      -- Totals for non-cancelled
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN quantity ELSE 0 END), 0) as total,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN price * quantity ELSE 0 END), 0) as revenue,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN checked_in_count ELSE 0 END), 0) as total_checked,
      
      -- Platinum
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'Platinum' THEN quantity ELSE 0 END), 0) as platinum,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'Platinum' THEN checked_in_count ELSE 0 END), 0) as platinum_checked,
      
      -- Donor
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'Donor' THEN quantity ELSE 0 END), 0) as donor,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'Donor' THEN checked_in_count ELSE 0 END), 0) as donor_checked,
      
      -- Student
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'Student' THEN quantity ELSE 0 END), 0) as student,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'Student' THEN checked_in_count ELSE 0 END), 0) as student_checked,
      
      -- VIP
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'VIP' THEN quantity ELSE 0 END), 0) as vip,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND type = 'VIP' THEN checked_in_count ELSE 0 END), 0) as vip_checked
    FROM filtered_tickets
    WHERE sold_by IS NOT NULL
    GROUP BY sold_by
    ORDER BY total DESC
  ) t;

  -- 4. Chart Data
  WITH filtered_tickets AS (
    SELECT * FROM tickets
    WHERE created_at >= v_start_date
      AND (p_type_filter = 'All Types' OR type = p_type_filter)
      AND (p_org_filter = 'All Organisers' OR sold_by ILIKE p_org_filter)
      AND (p_funds_filter = 'All Destinations' OR funds_destination = LOWER(p_funds_filter))
  )
  SELECT json_agg(t) INTO v_chart_data
  FROM (
    SELECT 
      type as name,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN quantity ELSE 0 END), 0) as sold,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN checked_in_count ELSE 0 END), 0) as checked_in,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN price * quantity ELSE 0 END), 0) as revenue
    FROM filtered_tickets
    GROUP BY type
    ORDER BY sold DESC
  ) t;

  -- 5. WhatsApp Stats
  WITH filtered_tickets AS (
    SELECT * FROM tickets
    WHERE created_at >= v_start_date
      AND (p_type_filter = 'All Types' OR type = p_type_filter)
      AND (p_org_filter = 'All Organisers' OR sold_by ILIKE p_org_filter)
      AND (p_funds_filter = 'All Destinations' OR funds_destination = LOWER(p_funds_filter))
  )
  SELECT json_build_object(
    'sent', COALESCE(COUNT(*) FILTER (WHERE whatsapp_status = 'sent'), 0),
    'failed', COALESCE(COUNT(*) FILTER (WHERE whatsapp_status = 'failed'), 0),
    'not_sent', COALESCE(COUNT(*) FILTER (WHERE whatsapp_status IS NULL OR whatsapp_status = 'not_sent'), 0)
  ) INTO v_whatsapp
  FROM filtered_tickets;

  -- Return final consolidated JSON
  RETURN json_build_object(
    'metrics', v_metrics,
    'leaderboard', COALESCE(v_leaderboard, '[]'::json),
    'chart_data', COALESCE(v_chart_data, '[]'::json),
    'whatsapp', v_whatsapp
  );
END;
$$ LANGUAGE plpgsql;
