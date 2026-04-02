-- M0: Seed PlatformDefinition
-- Source: PLATFORM_RULE_AND_AGENT_SPEC.md Tier 1 + Tier 2 platforms

INSERT INTO platform_definition (code, display_name, display_name_zh, region, platform_type, base_url, supports_direct_apply, supports_messaging, supports_first_contact, supports_reply_reading, supports_follow_up, supports_screening_questions, supports_cookie_session, supports_attachment_upload, current_v1_role, pipeline_mode, anti_scraping_level, max_daily_applications, max_daily_messages, captcha_frequency, min_plan_tier)
VALUES
  -- Tier 1: V1 Launch (global_english)
  ('linkedin', 'LinkedIn', 'LinkedIn', 'global_english', 'recruiter_network', 'https://www.linkedin.com',
    true, true, true, true, true, true, true, false,
    'search_detail_apply', 'full_tailored', 'high', 15, 10, 'rare', 'free'),

  ('greenhouse', 'Greenhouse', 'Greenhouse', 'global_english', 'ats_portal', 'https://boards.greenhouse.io',
    true, false, false, false, false, true, false, true,
    'search_detail_apply', 'full_tailored', 'low', 30, NULL, 'rare', 'free'),

  ('lever', 'Lever', 'Lever', 'global_english', 'ats_portal', 'https://jobs.lever.co',
    true, false, false, false, false, true, false, true,
    'search_detail_apply', 'full_tailored', 'low', 30, NULL, 'none', 'free'),

  -- Tier 1: V1 Launch (china)
  ('zhaopin', 'Zhaopin', '智联招聘', 'china', 'job_board', 'https://www.zhaopin.com',
    true, false, false, false, false, true, true, true,
    'search_detail_apply', 'passthrough', 'low', 30, NULL, 'rare', 'pro'),

  ('lagou', 'Lagou', '拉勾', 'china', 'job_board', 'https://www.lagou.com',
    true, false, false, false, false, true, true, true,
    'search_detail_apply', 'passthrough', 'medium', 30, NULL, 'rare', 'pro'),

  -- Tier 2: V1.1 (china)
  ('boss_zhipin', 'Boss Zhipin', 'Boss直聘', 'china', 'job_board', 'https://www.zhipin.com',
    false, true, true, true, true, false, true, false,
    'search_conversation', 'passthrough', 'extreme', 10, 10, 'frequent', 'pro'),

  ('liepin', 'Liepin', '猎聘', 'china', 'recruiter_network', 'https://www.liepin.com',
    true, true, false, true, true, true, true, true,
    'search_detail_apply', 'passthrough', 'medium', 20, 10, 'rare', 'pro');
