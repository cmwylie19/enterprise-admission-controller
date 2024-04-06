import { Capability, PeprMutateRequest, PeprValidateRequest, a } from "pepr";

export const Admission = new Capability({
  name: "Admission",
  description: "Global admission controler.",
  namespaces: [],
});

const { When } = Admission;

When(a.Pod)
  .IsCreatedOrUpdated()
  .Validate(po => {
    const podContainers = containers(po);
    for (const container of podContainers) {
      if (
        container.securityContext?.allowPrivilegeEscalation ||
        container.securityContext?.privileged
      ) {
        return po.Deny("Privilege escalation is not allowed");
      }
    }

    return po.Approve();
  });

export function containers(
  request: PeprValidateRequest<a.Pod> | PeprMutateRequest<a.Pod>,
  containerType?: "containers" | "initContainers" | "ephemeralContainers",
) {
  const containers = request.Raw.spec?.containers || [];
  const initContainers = request.Raw.spec?.initContainers || [];
  const ephemeralContainers = request.Raw.spec?.ephemeralContainers || [];

  if (containerType === "containers") {
    return containers;
  }
  if (containerType === "initContainers") {
    return initContainers;
  }
  if (containerType === "ephemeralContainers") {
    return ephemeralContainers;
  }
  return [...containers, ...initContainers, ...ephemeralContainers];
}
