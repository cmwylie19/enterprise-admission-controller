import { Capability, PeprMutateRequest, PeprValidateRequest, a } from "pepr";
import { V1Container } from "@kubernetes/client-node";
// import { containers } from "pepr/sdk"

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

const containerHelper = (container: V1Container) => {
  // set default if not there
  container.securityContext = container.securityContext || {};
  if (
    container.securityContext?.runAsUser &&
    container.securityContext?.runAsUser < 10
  ) {
    container.securityContext.runAsUser = 1000;
  } else if (!container.securityContext?.runAsUser) {
    container.securityContext.runAsUser = 655532;
  }
};
When(a.Pod)
  .IsCreatedOrUpdated()
  .Mutate(po => {
    if (!po.HasLabel("ignore-me")) {
      po.Raw.spec?.containers?.forEach(container => containerHelper(container));

      po.Raw.spec?.initContainers?.forEach(container =>
        containerHelper(container),
      );

      po.Raw.spec?.ephemeralContainers?.forEach(container =>
        containerHelper(container),
      );

      // define if not there
      po.Raw.spec.securityContext = po.Raw.spec.securityContext || {};

      if (
        po.Raw.spec.securityContext?.runAsUser &&
        po.Raw.spec.securityContext?.runAsUser < 10
      ) {
        po.Raw.spec.securityContext.runAsUser = 1000;
      } else if (!po.Raw.spec.securityContext?.runAsUser) {
        po.Raw.spec.securityContext.runAsUser = 655532;
      }
    }
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
