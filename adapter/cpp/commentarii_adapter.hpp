// Commentarii game adapter: minimal C++ declarations of the process-separated protocol
// (spec/feature/adapter-protocol.md). The TypeScript contract (src/adapter/) is the source of
// truth; this header mirrors it for native games. Declarations only: no dependencies, not
// built here. The game implements these functions (e.g. in the Bestia repository).
//
// Transport: the game starts `guide run --adapter stdio ...` as a child process and talks to
// it over the child's stdin / stdout, one UTF-8 JSON object per LF-terminated line.

#pragma once

#include <cstdint>
#include <iosfwd>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace commentarii {

inline constexpr int kProtocolVersion = 1;

enum class Mode { Player, Omniscient };
enum class Purpose { Efficiency, Coverage };
enum class Source { GameApi, RenderTap, Pixels };
enum class Knowledge { Shown, Discoverable, Masked };
enum class Result { Success, Fail, Abort };

struct Vector3 {
  double x = 0;
  double y = 0;
  double z = 0;
};

/** A value read from the game with its knowledge boundary. Player mode never sends Masked. */
struct ObservedNumber {
  double value = 0;
  Knowledge knowledge = Knowledge::Shown;
};

struct ObservedSelf {
  std::optional<Vector3> pos;
  /** HP bar as a ratio 0..1. */
  std::optional<ObservedNumber> hp;
  std::map<std::string, ObservedNumber> resources;
};

struct ObservedEntity {
  /** Guide entity ID (empty when the game could not identify it). */
  std::string entity;
  std::int64_t instance = 0;
  std::optional<Vector3> pos;
  /** Screen bounding box x, y, width, height. */
  std::optional<std::vector<double>> screen;
  /** state:<game>:<id>#<state>; leave empty when the state machine is masked in player mode. */
  std::string state_guess;
  std::optional<double> confidence;
};

struct ObservedStage {
  std::string id;
  std::optional<double> elapsed;
  std::string node;
};

struct ObservedEvent {
  std::string kind;
  /** Further fields as a JSON object text (written verbatim). */
  std::string fields_json;
};

struct ObservationFrame {
  std::int64_t tick = 0;
  double t = 0;
  Source source = Source::GameApi;
  Mode mode = Mode::Player;
  Purpose purpose = Purpose::Efficiency;
  ObservedSelf self;
  std::vector<ObservedEntity> entities;
  ObservedStage stage;
  std::vector<ObservedEvent> events;
  /** `extra` as a JSON object text (reach, ready_skills, items, ...). */
  std::string extra_json;
};

/** Game -> engine, first line. */
struct Hello {
  std::string game_id;
  std::string adapter_id;
  Mode mode = Mode::Player;
  /** Game-side entity key -> guide entity ID (the master import mapping). */
  std::map<std::string, std::string> identities;
};

/** Game -> engine, when the game ends. */
struct GameBye {
  Result result = Result::Success;
  /** `summary` as a JSON object text. */
  std::string summary_json;
};

/** Abstract action (design 7.3): exactly one verb. */
struct Action {
  enum class Verb { MoveTo, Attack, UseItem, UseSkill, Wait, Interact, Custom };
  enum class OperandKind { Id, Instance, Position, Seconds };

  Verb verb = Verb::Wait;
  OperandKind operand_kind = OperandKind::Seconds;
  /** Guide ID / node ID (OperandKind::Id) or the custom action name. */
  std::string id;
  std::int64_t instance = 0;
  Vector3 position;
  double seconds = 0;
  /** Optional `target`: an ID or an instance. */
  std::optional<std::string> target_id;
  std::optional<std::int64_t> target_instance;
  /** Optional `params` as a JSON object text. */
  std::string params_json;
};

/** Engine -> game: the action for one observation, or the engine's bye. */
struct EngineMessage {
  enum class Type { Action, Bye };
  Type type = Type::Action;
  /** Tick of the observation this action answers. */
  std::int64_t tick = 0;
  Action action;
  /** Bye reason: tick-limit / masked-in-player / mode-mismatch / error. */
  std::string bye_reason;
};

// --- Writing game -> engine lines (each call writes one JSON object and a single '\n'). ---

void write_hello(std::ostream& out, const Hello& hello);
void write_observation(std::ostream& out, const ObservationFrame& frame);
void write_bye(std::ostream& out, const GameBye& bye);

// --- Reading engine -> game lines. ---

/** Reads the next engine line. Returns false at end of input; throws on a malformed line. */
bool read_engine_message(std::istream& in, EngineMessage& message);

}  // namespace commentarii
