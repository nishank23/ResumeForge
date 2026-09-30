import React, { useState } from "react";
import { Lock, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  FormField,
  Input,
  Textarea,
  type ShellFederationContext,
} from "@resume-forge/shared";
export interface ProfileRemoteRootProps {
  readonly context?: ShellFederationContext;
}
const SAMPLE_HEADLINE = "Backend engineer specializing in distributed systems";
const SAMPLE_EXPERIENCE =
  "Led migration of a billing ingestion pipeline to partitioned stream workers, reducing p99 latency from 420ms to 95ms across 45,000 requests per second.";
export function ProfileRemoteRoot({ context }: ProfileRemoteRootProps) {
  const [headline, setHeadline] = useState(SAMPLE_HEADLINE);
  const [experience, setExperience] = useState(SAMPLE_EXPERIENCE);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  return (
    <div
      className="rf-page rf-narrow"
      data-remote-module="profile_mfe"
      data-react-version={React.version}
    >
      <div className="rf-page-heading">
        <h1>My profile</h1>
        <p>The source of your experience. A foundation for every resume.</p>
      </div>
      <div className="rf-profile-summary">
        <span className="rf-profile-avatar">
          <UserRound size={27} />
        </span>
        <div>
          <h2>Alex Rivera</h2>
          <p>{context?.activeWorkspace.name ?? "Personal workspace"}</p>
        </div>
        <Badge variant="outline">Sample profile</Badge>
      </div>
      <form
        className="rf-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (headline.trim().length < 6) {
            setError("Use at least 6 characters for your headline.");
            setNotice("");
            return;
          }
          setError(undefined);
          setNotice(
            "Preview checked. Nothing has been saved; profile storage is not connected yet.",
          );
        }}
      >
        <section>
          <h2>Professional details</h2>
          <p>
            Try editing the sample below. Changes reset when you leave this
            page.
          </p>
          <FormField label="Professional headline" required error={error}>
            {(props) => (
              <Input
                {...props}
                value={headline}
                onChange={(event) => {
                  setHeadline(event.target.value);
                  setNotice("");
                }}
              />
            )}
          </FormField>
          <FormField
            label="Experience highlight"
            description="Use a specific contribution and a result you can support."
          >
            {(props) => (
              <Textarea
                {...props}
                rows={5}
                value={experience}
                onChange={(event) => {
                  setExperience(event.target.value);
                  setNotice("");
                }}
              />
            )}
          </FormField>
        </section>
        <div className="rf-contact-note">
          <Lock size={20} />
          <div>
            <h3>Contact details</h3>
            <p>
              Contact editing will be available after secure account setup. You
              don't need to enter personal information in this preview.
            </p>
          </div>
        </div>
        <div className="rf-form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setHeadline(SAMPLE_HEADLINE);
              setExperience(SAMPLE_EXPERIENCE);
              setError(undefined);
              setNotice("");
            }}
          >
            Reset sample
          </Button>
          <Button type="submit">Check preview</Button>
        </div>
        {notice ? (
          <p className="rf-inline-success" role="status">
            {notice}
          </p>
        ) : null}
      </form>
    </div>
  );
}
export default ProfileRemoteRoot;
