import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lock, UserRound } from "lucide-react";
import {
  Button,
  FormField,
  Input,
  DocumentStatus,
  StudioLoading,
  Textarea,
  useSession,
  type ShellFederationContext,
} from "@resume-forge/shared";
import {
  createProfileClient,
  profileFields,
  validateFields,
  ProfileApiError,
  type ProfessionalFields,
  type ProfessionalProfile,
} from "./profile-api";
import "./profile.css";
export interface ProfileRemoteRootProps {
  readonly context?: ShellFederationContext;
}
export function ProfileRemoteRoot({ context }: ProfileRemoteRootProps) {
  if (!context)
    return (
      <div className="rf-page rf-narrow">
        <div className="rf-page-heading">
          <h1>My profile</h1>
          <p>
            Open your signed-in workspace to load and save professional details.
          </p>
        </div>
        <a className="rf-text-link" href="http://localhost:3000/">
          Open resume-forge
        </a>
      </div>
    );
  return (
    <ConnectedProfile key={context.activeWorkspace.id} context={context} />
  );
}
function ConnectedProfile({ context }: { context: ShellFederationContext }) {
  const { state: session, requestApi } = useSession();
  const client = useMemo(
    () => createProfileClient(requestApi, context.activeWorkspace.id),
    [requestApi, context.activeWorkspace.id],
  );
  const [base, setBase] = useState<ProfessionalProfile | null>(null);
  const [fields, setFields] = useState<ProfessionalFields>(() =>
    profileFields(null),
  );
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfessionalFields, string>>
  >({});
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const incomplete =
    session.status === "authenticated" && !session.identity.isOnboarded;
  const dirty = JSON.stringify(fields) !== JSON.stringify(profileFields(base));
  const conflict = [
    "revision_conflict",
    "profile_exists",
    "onboarding_complete",
    "not_found",
  ].includes(failure);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void client
      .load(controller.signal)
      .then((profile) => {
        if (controller.signal.aborted) return;
        setBase(profile);
        setFields(profileFields(profile));
        setLoaded(true);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailure("unavailable");
          setLoading(false);
        }
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [client]);
  useEffect(() => {
    if (
      Object.keys(errors).some((key) =>
        Boolean(errors[key as keyof ProfessionalFields]),
      )
    )
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [errors]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
  const reload = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setNotice("");
    try {
      const profile = await client.load();
      if (!alive.current) return;
      setBase(profile);
      setFields(profileFields(profile));
      setLoaded(true);
      setFailure("");
      setErrors({});
      setNotice(
        profile
          ? "Loaded the saved profile. Unsaved edits were discarded."
          : "Your resume library is ready. No profile setup is required.",
      );
    } catch {
      if (alive.current) setFailure("unavailable");
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };
  const save = async () => {
    if (busy.current || conflict) return;
    const validation = validateFields(fields);
    setErrors(validation);
    setNotice("");
    if (Object.keys(validation).length) return;
    busy.current = true;
    setSaving(true);
    setFailure("");
    try {
      const saved = await client.save(fields, base, incomplete);
      if (!alive.current) return;
      setBase(saved);
      setFields(profileFields(saved));
      setNotice("Professional details saved to your account.");
    } catch (error) {
      if (alive.current)
        setFailure(
          error instanceof ProfileApiError ? error.code : "unavailable",
        );
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const edit = (field: keyof ProfessionalFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setNotice("");
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  if (loaded && (!base || !base.fullName))
    return (
      <div className="rf-page rf-narrow">
        <div className="rf-page-heading">
          <h1>My profile</h1>
          <p>
            Your account details come from sign-in. Your experience comes from
            your resumes.
          </p>
        </div>
        <section className="rf-profile-summary">
          <UserRound size={27} />
          <div>
            <h2>
              {session.status === "authenticated"
                ? (session.identity.name ?? "Your account")
                : "Your account"}
            </h2>
            <p>
              No profile setup needed. Upload or create a resume to add
              professional details.
            </p>
            <Button
              onClick={() =>
                context.onNavigate?.(`/w/${context.activeWorkspace.id}/resumes`)
              }
            >
              Open my resumes
            </Button>
          </div>
        </section>
      </div>
    );
  return (
    <div
      className="rf-page rf-narrow"
      data-remote-module="profile_mfe"
      data-react-version={React.version}
    >
      <div className="rf-page-heading">
        <h1>{incomplete ? "My profile" : "My profile"}</h1>
        <p>The source of your experience. A foundation for every resume.</p>
      </div>
      {loading && !loaded ? (
        <div className="rf-profile-state">
          <StudioLoading
            compact
            reducedMotion={context.reducedMotion}
          />
        </div>
      ) : null}
      {failure ? (
        <div className="rf-profile-error" role="alert">
          <p>
            {conflict
              ? "The saved profile changed. Your edits are still below. Copy anything you need, then load the saved version before editing again."
              : failure === "forbidden"
                ? "This profile isn’t available in the selected workspace."
                : failure === "invalid_input"
                  ? "Check your professional details and try saving again."
                  : !loaded
                    ? "We couldn’t load your professional profile. Check your connection and retry."
                    : "Profile request failed. Your edits are still here. A save may have reached the server; load the saved version before retrying if you’re unsure."}
          </p>
          <Button
            variant="outline"
            disabled={loading || saving}
            onClick={() => {
              void reload();
            }}
          >
            {loaded ? "Load saved version" : "Retry loading profile"}
          </Button>
        </div>
      ) : null}
      {loaded ? (
        <>
          <div className="rf-profile-summary">
            <span className="rf-profile-avatar">
              <UserRound size={27} aria-hidden="true" />
            </span>
            <div>
              <h2>{base?.fullName ?? "Your professional details"}</h2>
              <p>{context.activeWorkspace.name}</p>
            </div>
            <DocumentStatus tone={saving || dirty ? "pending" : "saved"}>
              {saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : base
                    ? "Saved to account"
                    : "New profile"}
            </DocumentStatus>
          </div>
          <form
            className="rf-profile-form"
            ref={form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            aria-busy={saving || loading}
          >
            <section>
              <h2>Professional details</h2>
              <p>
                {incomplete
                  ? "Save the details you want to reuse. Your resume library is always available."
                  : "Update your master profile using facts you can support."}
              </p>
              <FormField label="Full name" required error={errors.fullName}>
                {(props) => (
                  <Input
                    {...props}
                    autoComplete="name"
                    value={fields.fullName}
                    maxLength={200}
                    disabled={saving || loading}
                    onChange={(event) => {
                      edit("fullName", event.target.value);
                    }}
                  />
                )}
              </FormField>
              <FormField
                label="Location"
                description="Optional city or region. Keep street addresses out of your professional profile."
                error={errors.location}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={fields.location}
                    maxLength={200}
                    disabled={saving || loading}
                    onChange={(event) => {
                      edit("location", event.target.value);
                    }}
                  />
                )}
              </FormField>
              <FormField
                label="Professional summary"
                description="Optional. Describe your experience in your own words; include only supported facts."
                error={errors.professionalSummary}
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={6}
                    value={fields.professionalSummary}
                    maxLength={5000}
                    disabled={saving || loading}
                    onChange={(event) => {
                      edit("professionalSummary", event.target.value);
                    }}
                  />
                )}
              </FormField>
            </section>
            <div className="rf-contact-note">
              <Lock size={20} aria-hidden="true" />
              <div>
                <h3>Contact details stay separate</h3>
                <p>
                  This form saves only your name, location and professional
                  summary. Contact and section editing will follow.
                </p>
              </div>
            </div>
            <p className="rf-profile-save-status" role="status">
              {notice ||
                (dirty
                  ? "Unsaved edits stay on this page until you save."
                  : base
                    ? "Your professional details are saved. Reloading will restore them."
                    : "Nothing is saved until you create your profile.")}
            </p>
            <div className="rf-form-actions">
              <Button
                variant="outline"
                disabled={!dirty || saving || loading}
                onClick={() => {
                  setFields(profileFields(base));
                  setErrors({});
                  setNotice("");
                }}
              >
                Discard edits
              </Button>
              <Button
                type="submit"
                loading={saving}
                loadingText="Saving details…"
                disabled={loading || conflict || (!dirty && Boolean(base))}
              >
                {base
                  ? incomplete
                    ? "Save draft"
                    : "Save changes"
                  : "Save details"}
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
export default ProfileRemoteRoot;
